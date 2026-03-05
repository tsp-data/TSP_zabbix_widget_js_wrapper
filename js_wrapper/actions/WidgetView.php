<?php

namespace Modules\VueWrapper\Actions;

use CControllerDashboardWidgetView;
use CControllerResponseData;

class WidgetView extends CControllerDashboardWidgetView {

	protected function doAction(): void {
		$this->setResponse(new CControllerResponseData([
			'name' => $this->getInput('name', $this->widget->getName()),
			'component' => $this->fields_values['component'] ?? 'MyChart',
			'conf_json' => $this->fields_values['conf_json'] ?? '{}'
		]));
	}
}
