#!/usr/bin/env bash

set -e
set -u
set -o pipefail

# more bash-friendly output for jq
JQ="jq --raw-output --exit-status"

deploy_image() {

    docker login -u $DOCKER_USER -p $DOCKER_PASS -e $DOCKER_EMAIL
    docker push "tibber/template:1.$CIRCLE_BUILD_NUM" | cat # workaround progress weirdness
    docker push "tibber/template:latest" | cat
}

# reads $CIRCLE_SHA1, $host_port
# sets $task_def
make_task_def() {

    tibber_com='[{
      "memory": 300,
      "essential": true,
      "name": "tibber_template",
      "environment": [
        {
          "name": "POSTGRES_CONNECTION",
          "value": "%s"
        },
        {
          "name": "STRIPE_SECRET_KEY",
          "value": "%s"
        },
        {
          "name": "SUBSCRIPTIONSERVICE_BASEURL",
          "value": "http://tibber_subscription:3000"
        },
        {
          "name": "WALLETSERVICE_BASEURL",
          "value": "http://tibber_wallet:5000"
        },
        {
          "name": "APP_ENV",
          "value": "%s"
        }
      ],
      "readonlyRootFilesystem": false,
      "image": "tibber/template:1.%s",
      "cpu": 100
    }]'

    task_def=$(printf "$tibber_com" $postgres $stripe $env $CIRCLE_BUILD_NUM)

}

# reads $family
# sets $revision
register_definition() {

    if revision=$(aws ecs register-task-definition --container-definitions "$task_def" --family $family | $JQ '.taskDefinition.taskDefinitionArn'); then
        echo "Revision: $revision"
    else
        echo "Failed to register task definition"
        return 1
    fi

}

deploy_definition(){
    make_task_def
    register_definition  
}

deploy_cluster() {

    make_task_def
    register_definition
    if [[ $(aws ecs update-service --cluster $cluster --service $service_name --task-definition $revision | \
                   $JQ '.service.taskDefinition') != $revision ]]; then
        echo "Error updating service."
        return 1
    fi

    # wait for older revisions to disappear
    # not really necessary, but nice for demos
    for attempt in {1..30}; do
        if stale=$(aws ecs describe-services --cluster $cluster --services $service_name | \
                       $JQ ".services[0].deployments | .[] | select(.taskDefinition != \"$revision\") | .taskDefinition"); then
            echo "Waiting for stale deployments:"
            echo "$stale"
            sleep 5
        else
            echo "Deployed!"
            return 0
        fi
    done
    echo "Service update took too long."
    return 1
}
postgres="${POSTGRES_CONNECTION_DEV}"
stripe=${STRIPE_SECRET_KEY_DEV}
cluster="dev"
family="dev-tibber-template"
service_name="dev-tibber-template"
env="TEST"

deploy_image
deploy_cluster

postgres=${POSTGRES_CONNECTION_PROD}
stripe=${STRIPE_SECRET_KEY_PROD}
family="prod-tibber-template"
env="PROD"
deploy_definition
