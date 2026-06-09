using TaskService as service from '../../srv/task-service';

annotate service.Tasks with @(
  UI.HeaderInfo                : {
    TypeName      : 'Task',
    TypeNamePlural: 'Tasks',
    Title         : {Value: title},
    Description   : {Value: status}
  },
  UI.FieldGroup #GeneratedGroup: {
    $Type: 'UI.FieldGroupType',
    Data : [
      {
        $Type: 'UI.DataField',
        Label: 'title',
        Value: title,
      },
      {
        $Type: 'UI.DataField',
        Label: 'description',
        Value: description,
      },
      {
        $Type: 'UI.DataField',
        Label: 'status',
        Value: status,
      },
    ],
  },
  UI.Facets                    : [{
    $Type : 'UI.ReferenceFacet',
    ID    : 'GeneratedFacet1',
    Label : 'General Information',
    Target: '@UI.FieldGroup#GeneratedGroup',
  }, ],
  UI.LineItem                  : [
    {
      $Type: 'UI.DataField',
      Label: 'title',
      Value: title,
    },
    {
      $Type: 'UI.DataField',
      Label: 'description',
      Value: description,
    },
    {
      $Type: 'UI.DataField',
      Label: 'status',
      Value: status,
    },
  ],
  UI.SelectionFields           : [status]
);

annotate service.Tasks with {
  status @(
    Common.ValueList               : {
      CollectionPath: 'Statuses',
      Parameters    : [{
        $Type            : 'Common.ValueListParameterOut',
        LocalDataProperty: status,
        ValueListProperty: 'value'
      }]
    },
    Common.ValueListWithFixedValues: true
  )
};
