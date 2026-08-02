<?php

/** @var CView $this */
/** @var array $data */

/*
 * `asset_versions` travels as a top level key of the JSON response rather than in the
 * body markup: this widget's processUpdateResponse() deliberately does not call super,
 * so the rendered body is never inserted into the page and anything carried in it would
 * be lost.
 */
(new CWidgetView($data))
	->addItem(new CDiv('', 'vue-wrapper-root'))
	->setVar('asset_versions', $data['asset_versions'] ?? [])
	->show();
