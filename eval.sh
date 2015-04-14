#!/bin/bash

for query in $3/*.rq
do
	echo $query
	echo "$1 -c $2 $query"
	results=$(timeout 6m ./bin/$1 -c $2 $query)
	echo "$results"
done
