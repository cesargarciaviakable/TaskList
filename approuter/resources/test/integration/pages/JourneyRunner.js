sap.ui.define([
    "sap/fe/test/JourneyRunner",
	"my/first/tasks/test/integration/pages/TasksList",
	"my/first/tasks/test/integration/pages/TasksObjectPage"
], function (JourneyRunner, TasksList, TasksObjectPage) {
    'use strict';

    var runner = new JourneyRunner({
        launchUrl: sap.ui.require.toUrl('my/first/tasks') + '/test/flp.html#app-preview',
        pages: {
			onTheTasksList: TasksList,
			onTheTasksObjectPage: TasksObjectPage
        },
        async: true
    });

    return runner;
});

