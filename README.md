# Amplify CLI Nested Stack Sample

This project can serve as a sample for getting started with the new nested stacks implementation of the Amplify CLI API category.

# Setup

This project only works when using the **nested-stacks** branch of this repository:

https://github.com/mikeparisstuff/amplify-cli/tree/nested-stacks

To get started, clone that repo and then run `npm run setup-dev` from the root
of the project directory. When that command finishes, the `amplify` command on
your machine will now map to the nested-stacks build.

# How to add custom resources

Open `src/amplify/backend/api/stacks/CustomResources.yml` and add any resources that you would like deployed
when you run `amplify push`. You can use the parameters passed into the template to create resources
based on the CLI environment as well as reference the the AppSync API that was created for you by Amplify.

Let's walk through how we would add a custom `Query.customResolver` field that knows
how to get a single `Todo` object by default. Here is how.

First add the field in your `schema.graphql`:

```graphql
type Todo @model {
  id: ID!
  name: String!
  description: String
}
type Query {
  customGetTodo(id: ID!): Todo
}
```

Then add a resource to `src/amplify/backend/api/stacks/CustomResources.yml`:

```yaml
# Parameters pass references to the API and deployment locations.
CustomGetTodoResolver:
  Type: AWS::AppSync::Resolver
  Properties:
    ApiId:
    Ref: AppSyncApiId
    DataSourceName: TodoTable # This table was created by @model
    TypeName: Query
    FieldName: customGetTodo  # Target the field in your schema
    RequestMappingTemplateS3Location:
      Fn::Sub:
      - s3://${S3DeploymentBucket}/${S3DeploymentRootKey}/resolvers/Query.customGetTodo.request.vtl
      - S3DeploymentBucket:
          Ref: S3DeploymentBucket
        S3DeploymentRootKey:
          Ref: S3DeploymentRootKey
    ResponseMappingTemplateS3Location:
      Fn::Sub:
      - s3://${S3DeploymentBucket}/${S3DeploymentRootKey}/resolvers/Query.customGetTodo.response.vtl
      - S3DeploymentBucket:
          Ref: S3DeploymentBucket
        S3DeploymentRootKey: 
          Ref: S3DeploymentRootKey
    # All templates in the resolver directory are uploaded to the deployment location
```

Lastly place the resolver templates in the top level resolvers directory.

**src/amplify/backend/api/resolvers/Query.customGetTodo.request.vtl**

```
{
  "version": "2017-02-28",
  "operation": "GetItem",
  "key": {
      "id": $util.dynamodb.toDynamoDBJson($ctx.args.id)
  }
}
```

**src/amplify/backend/api/resolvers/Query.customGetTodo.response.vtl**

```
$util.toJson($ctx.result)
```

Now when you run `amplify push`, your custom resources will be deployed alongside
the rest of your API. Custom stacks automatically take a dependency on auto-generated
resources so you can reliably refer to resources that are created by the Amplify API category.

# Override default resolver templates

Let's imagine we had the same schema as is default in this project as shown below.

```graphql
type Todo @model {
  id: ID!
  name: String!
  description: String
}
```

When we run `amplify api gql-compile`, Amplify is going to compile our simplified
schema document into a set of AWS CloudFormation documents, AWS AppSync resolver
templates, and the following schema.

```graphql
type Todo {
  id: ID!
  name: String!
  description: String
}

type Query {
  getTodo(id: ID!): Todo
  listTodos(filter: ModelTodoFilterInput, limit: Int, nextToken: String): ModelTodoConnection
}

# ... boilerplate types

type Mutation {
  createTodo(input: CreateTodoInput!): Todo
  updateTodo(input: UpdateTodoInput!): Todo
  deleteTodo(input: DeleteTodoInput!): Todo
}

type Subscription {
  onCreateTodo: Todo @aws_subscribe(mutations: ["createTodo"])
  onUpdateTodo: Todo @aws_subscribe(mutations: ["updateTodo"])
  onDeleteTodo: Todo @aws_subscribe(mutations: ["deleteTodo"])
}
```

AppSync provides default behaviors for the generated mutations and queries that can be tweaked using
other directives like `@auth` and `@versioned`. This is great for getting started, but sometimes you
will want to tweak the default behavior and implement your own business logic.

**How to override default resolver templates**

The short way to tweak the behavior is to create a file in the top level `resolvers`
directory of your amplify project's api category to named `Type.field.request.vtl` or
`Type.field.response.vtl`. For example, we could update the behavior for our
`Query.getTodo` query field by adding the file `Query.getTodo.request.vtl` to
`src/amplify/backend/amplifynestedsample/resolvers/Query.getTodo.request.vtl` with
the following contents.

```
#if($ctx.args.input.id === "13")
    $util.error("Can't create unlucky todo objects")
#end
{
  "version": "2017-02-28",
  "operation": "GetItem",
  "key": {
      "id": $util.dynamodb.toDynamoDBJson($ctx.args.id)
  }
}
```

The next time you run `amplify push`, this file will get merged on top of the auto-generated
file. You can also verify this by running `amplify api gql-compile` and checking the build output
`src/amplify/backend/amplifynestedsample/build/resolvers/Query.getTodo.request.vtl`.
