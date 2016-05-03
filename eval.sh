#!/bin/bash

for query in $3/*.rq
do
	echo $query
	echo "$1 -c $2 $query"
	results=$(timeout 15m ./bin/$1 -c $2 $query --maxNumberOfMappings 30)
	echo "$results"
done
