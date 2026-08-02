<?php

namespace Modules\VueWrapper\Actions;

use CControllerDashboardWidgetView;
use CControllerResponseData;

class WidgetView extends CControllerDashboardWidgetView {

	/**
	 * Same pattern the client side enforces on "component".
	 *
	 * Repeated here because the value reaches the filesystem below, and a client side
	 * check is no check at all: "component" comes from widget configuration and could
	 * contain path segments.
	 */
	private const COMPONENT_PATTERN = '/^[A-Za-z0-9_-]+$/';

	protected function doAction(): void {
		$component = $this->fields_values['component'] ?? 'MyChart';

		$this->setResponse(new CControllerResponseData([
			'name' => $this->getInput('name', $this->widget->getName()),
			'component' => $component,
			'conf_json' => $this->fields_values['conf_json'] ?? '{}',
			'asset_versions' => $this->getAssetVersions($component)
		]));
	}

	/**
	 * Modification times of the UMD assets, used as cache busting tokens.
	 *
	 * The wrapper loads a component from a URL that is otherwise constant across
	 * releases, so a browser that cached one build keeps it. Worse, the script is
	 * injected after the page has loaded, which is outside the scope of a hard reload -
	 * so users cannot even clear it themselves. Appending the file's mtime makes the URL
	 * change exactly when the file does, with nothing to remember on deployment.
	 *
	 * A missing file yields no token rather than an error: the wrapper then requests the
	 * bare URL and reports the failed load as it always has.
	 *
	 * @param string $component
	 *
	 * @return array<string, string>  Keyed by asset kind ("js", "css")
	 */
	private function getAssetVersions(string $component): array {
		if (preg_match(self::COMPONENT_PATTERN, $component) !== 1) {
			return [];
		}

		$base = __DIR__.'/../assets/umd/'.$component;
		$versions = [];

		foreach (['js' => $base.'.umd.js', 'css' => $base.'.css'] as $kind => $path) {
			$mtime = @filemtime($path);

			if ($mtime !== false) {
				$versions[$kind] = (string) $mtime;
			}
		}

		return $versions;
	}
}
