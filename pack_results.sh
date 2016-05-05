#!/bin/bash
mkdir -p output
zip /home/admin/tpf_evaluation/Client.js/output/${3}clients.${1}.${2}.csv.zip /home/admin/tpf_evaluation/Client.js/eval*.csv /home/admin/tpf_evaluation/Client.js/executed_queries_list_*
rm /home/admin/tpf_evaluation/Client.js/eval*.csv /home/admin/tpf_evaluation/Client.js/executed_queries_list_*
