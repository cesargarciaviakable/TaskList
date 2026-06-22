sap.ui.define([
    "sap/ui/test/opaQunit"
], function (opaTest) {
    "use strict";

    QUnit.module("Approval Journey");

    opaTest("Should see the approval list", function (Given, When, Then) {
        // Arrangements
        Given.iStartMyAppInAFrame("index.html");

        // Assertions
        Then.onTheListReport().iSeeThisPage();

        // Cleanup
        Then.iTeardownMyApp();
    });
});
