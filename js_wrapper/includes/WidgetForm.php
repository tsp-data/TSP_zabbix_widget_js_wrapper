<?php
namespace Modules\VueWrapper\Includes;

use Zabbix\Widgets\CWidgetForm;
use Zabbix\Widgets\CWidgetField;
use Zabbix\Widgets\Fields\CWidgetFieldTextBox;
use Zabbix\Widgets\Fields\CWidgetFieldTextArea;


class WidgetForm extends CWidgetForm {
	public function addFields(): self {
		return $this
			->addField(
				(new CWidgetFieldTextBox('component', _('Component name')))
					->setDefault('MyChart')
					->setFlags(CWidgetField::FLAG_NOT_EMPTY | CWidgetField::FLAG_LABEL_ASTERISK)
			)
			->addField(
				(new CWidgetFieldTextArea('conf_json', _('conf (JSON)')))
					->setDefault('{}')
			);
	}
}
