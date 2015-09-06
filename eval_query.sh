#!/bin/bash

res1=$(date +%s.%N)
res2=$(date +%s.%N)
results=$(timeout 6m ./bin/$1 -c $2 $3)
echo "$results"