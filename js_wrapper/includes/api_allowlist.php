<?php

/**
 * Methods the js_wrapper API gate ("widget.js_wrapper.api") will forward.
 *
 * Every call is executed with the permissions of the logged-in user - their role's API
 * access rules and per-object permissions apply exactly as they would to a personal API
 * token. This list is therefore defense in depth, not the security boundary: it keeps
 * the gate from being a generic tunnel into parts of the API that no deployed module
 * needs, and it is the one file to edit when a new module does need more.
 *
 * Entries are "service.method", lowercase, with "*" accepted for either segment:
 *
 *   'maintenance.get'    exactly this method
 *   'maintenance.*'      every method of the maintenance service
 *   '*.get'              the read method of every service
 *
 * A missing or empty file denies everything (the gate fails closed).
 */
return [
	// No secrets, useful as a connectivity check; needs no authentication either way.
	'apiinfo.version',

	// Reads return only what the user is permitted to see, so this is safe to keep
	// broad - and it is what makes the gate useful to a module without editing this
	// file for every new read.
	'*.get',

	// Writes are listed per method, per module that needs them.
	// maintenance_calendar:
	'maintenance.create',
	'maintenance.update',
	'maintenance.delete'
];
