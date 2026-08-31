<?php

namespace Modules\VueWrapper\Actions;

use CApiServiceFactory;
use CController;
use CControllerResponseData;
use CJsonRpc;
use CWebUser;
use Modules\VueWrapper\Includes\SessionApiClient;

/**
 * Session-authenticated Zabbix API gate for UMD modules ("widget.js_wrapper.api").
 *
 * The wrapper exposes this action to modules as `zbx.api(method, params)`. A module
 * calling it acts with the permissions of the *logged-in user*, not with a shared API
 * token stored in the widget configuration - which is the point: nothing secret sits in
 * `conf_json`, and a user can only do what their own account allows.
 *
 * The alternative remains available. A module may keep calling `api_jsonrpc.php` with a
 * token from its configuration and never touch this gate; the two access modes are both
 * legitimate, they just serve different trust models (see "Host API" in README.md).
 *
 * What the gate enforces, in order:
 *
 * - CSRF. Deliberately NOT disabled: this action can write. `CController` checks the
 *   token of a module action against the full action name, so the client sends the
 *   value of `CCsrfTokenHelper::get('widget.js_wrapper.api')`, handed to it by
 *   WidgetView.php with each widget update response.
 * - The allowlist (`includes/api_allowlist.php`). Defense in depth, not the security
 *   boundary - the boundary is the user's own permissions - but it keeps the gate from
 *   being a generic tunnel to parts of the API no shipped module needs.
 * - The role's API access rules. `CLocalApiClient` skips those outside of
 *   api_jsonrpc.php, so SessionApiClient re-adds the check: a role with API access
 *   disabled is refused here exactly as it would be with a token of its own.
 * - Everything `api_jsonrpc.php` enforces - authentication, per-object permissions -
 *   because the call goes through the same `CLocalApiClient` machinery.
 *
 * Request:  POST JSON `{ "method": "maintenance.get", "params": {...}, "_csrf_token": "..." }`
 * Response: `{ "result": ... }` on success, `{ "error": { "code", "message", "data" } }`
 *           on failure - the same error shape api_jsonrpc.php produces, so a module can
 *           share its error handling between both access modes.
 */
class WidgetApi extends CController {

	/**
	 * Method name shape: "service.method". The character set matches what the API
	 * service registry can contain; anything else is rejected before dispatch.
	 */
	private const METHOD_PATTERN = '/^[a-z][a-z0-9]*\.[a-z][a-z0-9]*$/i';

	protected function init(): void {
		$this->setPostContentType(self::POST_CONTENT_TYPE_JSON);
		// CSRF validation is intentionally left enabled - see the class comment.
	}

	protected function checkInput(): bool {
		$ret = $this->validateInput([
			'method' => 'required|string',
			'params' => 'array'
		]);

		if (!$ret) {
			$this->setResponse(self::errorResponse(-32602, _('Invalid params.'),
				'Expected JSON body {"method": "service.method", "params": object|array}.'
			));
		}

		return $ret;
	}

	protected function checkPermissions(): bool {
		return $this->getUserType() >= USER_TYPE_ZABBIX_USER;
	}

	protected function doAction(): void {
		$method = strtolower(trim($this->getInput('method')));
		$params = $this->getInput('params', []);

		if (preg_match(self::METHOD_PATTERN, $method) !== 1) {
			$this->setResponse(self::errorResponse(-32602, _('Invalid params.'),
				'Malformed "method": expected "service.method".'
			));

			return;
		}

		if (!self::isMethodAllowed($method)) {
			$this->setResponse(self::errorResponse(-32500, _('Application error.'),
				'Method "'.$method.'" is not allowed by the js_wrapper API gate'.
					' (modules/js_wrapper/includes/api_allowlist.php).'
			));

			return;
		}

		[$api, $api_method] = explode('.', $method, 2);

		$client = new SessionApiClient();
		$client->setServiceFactory(new CApiServiceFactory());

		/*
		 * AUTH_TYPE_COOKIE gives the sessionid the same treatment api_jsonrpc.php gives
		 * a session cookie: it is quietly dropped for the few methods that must be
		 * called unauthenticated (apiinfo.version), instead of being rejected.
		 */
		$response = $client->callMethod($api, $api_method, $params, [
			'type' => CJsonRpc::AUTH_TYPE_COOKIE,
			'auth' => CWebUser::$data['sessionid'] ?? null
		]);

		if ($response->errorCode) {
			// Mask database errors for non-superadmins, as CJsonRpc::processResult() does.
			$detail = ($response->errorCode == ZBX_API_ERROR_DB && $this->getUserType() != USER_TYPE_SUPER_ADMIN)
				? _('System error occurred. Please contact Zabbix administrator.')
				: $response->errorMessage;

			[$code, $message] = self::jsonRpcError($response->errorCode);
			$this->setResponse(self::errorResponse($code, $message, $detail));

			return;
		}

		$this->setResponse(new CControllerResponseData([
			'main_block' => json_encode(['result' => $response->data])
		]));
	}

	/**
	 * Map a ZBX_API_ERROR_* code onto the JSON-RPC code and generic message that
	 * api_jsonrpc.php would use (CJsonRpc: $_zbx2jsonErrors + $_error_list), so both
	 * access modes fail with an identically shaped error.
	 *
	 * @param int $zbx_error_code
	 *
	 * @return array{0: int, 1: string}
	 */
	private static function jsonRpcError(int $zbx_error_code): array {
		switch ($zbx_error_code) {
			case ZBX_API_ERROR_NO_METHOD:
				return [-32601, _('Method not found.')];

			case ZBX_API_ERROR_PARAMETERS:
			case ZBX_API_ERROR_NO_AUTH:
				return [-32602, _('Invalid params.')];

			default:
				return [-32500, _('Application error.')];
		}
	}

	/**
	 * Match a method against the deployment-editable allowlist.
	 *
	 * Patterns are "service.method" with "*" accepted for either segment. A missing or
	 * empty allowlist file denies everything, with the error message above pointing at
	 * the file - failing closed beats silently allowing.
	 *
	 * @param string $method Lowercase "service.method"
	 *
	 * @return bool
	 */
	private static function isMethodAllowed(string $method): bool {
		static $allowlist;

		if ($allowlist === null) {
			$file = __DIR__.'/../includes/api_allowlist.php';
			$allowlist = is_file($file) ? (array) include $file : [];
		}

		[$api, $api_method] = explode('.', $method, 2);

		foreach ($allowlist as $pattern) {
			$parts = explode('.', strtolower(trim((string) $pattern)), 2);

			if (count($parts) != 2) {
				continue;
			}

			[$pattern_api, $pattern_method] = $parts;

			if (($pattern_api === '*' || $pattern_api === $api)
					&& ($pattern_method === '*' || $pattern_method === $api_method)) {
				return true;
			}
		}

		return false;
	}

	private static function errorResponse(int $code, string $message, ?string $data): CControllerResponseData {
		$error = ['code' => $code, 'message' => $message];

		if ($data !== null && $data !== '') {
			$error['data'] = $data;
		}

		return new CControllerResponseData(['main_block' => json_encode(['error' => $error])]);
	}
}
