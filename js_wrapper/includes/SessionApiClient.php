<?php

namespace Modules\VueWrapper\Includes;

use APIException;
use CLocalApiClient;

/**
 * CLocalApiClient that also enforces the user role's API access rules.
 *
 * CLocalApiClient checks those rules - the role's "API access" toggle and its
 * allowed/denied method lists - only when running as api_jsonrpc.php
 * (`APP::getMode() === APP::EXEC_MODE_API`). The js_wrapper API gate runs in frontend
 * mode, where the parent skips that check entirely, so it is re-added here. Without it
 * the gate would quietly reopen the API for a role whose API access an administrator
 * has switched off, which must not depend on which door the request came through.
 *
 * The check reuses the parent's own protected isAllowedMethod() rather than reading
 * role_rule itself, so the semantics track Zabbix exactly.
 */
class SessionApiClient extends CLocalApiClient {

	private string $request_api = '';
	private string $request_method = '';

	public function callMethod(string $requestApi, string $requestMethod, array $params, array $auth) {
		$this->request_api = strtolower($requestApi);
		$this->request_method = strtolower($requestMethod);

		return parent::callMethod($requestApi, $requestMethod, $params, $auth);
	}

	/**
	 * Called by the parent inside its try block, and only for methods that require
	 * authentication - which is exactly where api_jsonrpc.php runs its own
	 * isAllowedMethod() check, right after authentication has populated the user data
	 * the role lookup needs. The exempt methods (apiinfo.version) stay exempt.
	 *
	 * @param string $auth
	 *
	 * @throws APIException
	 */
	protected function authenticate($auth) {
		parent::authenticate($auth);

		if (!$this->isAllowedMethod($this->request_api, $this->request_method)) {
			throw new APIException(ZBX_API_ERROR_PERMISSIONS,
				_s('No permissions to call "%1$s.%2$s".', $this->request_api, $this->request_method)
			);
		}
	}
}
