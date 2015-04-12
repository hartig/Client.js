#!/bin/bash

res1=$(date +%s.%N)
res2=$(date +%s.%N)
results=$(./bin/$1 $2 $3)
echo "$results"