wget "http://localhost:8080/api/v3/api-docs" -outfile "api-docs.json"
openapi-generator-cli generate -i api-docs.json -g typescript-axios -o .
#-c config.yaml