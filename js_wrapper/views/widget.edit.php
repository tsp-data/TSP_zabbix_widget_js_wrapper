<?php

/**
 * Vue wrapper widget configuration view.
 *
 * @var CView $this
 * @var array $data
 */

use Modules\VueWrapper\Includes\WidgetForm;

(new CWidgetFormView($data))
	->addField(new CWidgetFieldTextBoxView($data['fields']['component']))
	->addField(new CWidgetFieldTextAreaView($data['fields']['conf_json']))
	->show();
