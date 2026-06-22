/* global QUnit */

QUnit.config.autostart = false;

sap.ui.getCore().attachInit(function() {
    "use strict";

    sap.ui.require([
        "my/first/approvals/test/integration/FirstJourney"
    ], function() {
        QUnit.start();
    });
});
