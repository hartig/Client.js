import json
import traceback
import sys
import glob
from multiprocessing import Pool
import urllib2
import urllib
import time
import requests


def run_query(query, url):
    payload = {'query': query, 'format': 'json'}

    try:
        r = requests.post(url, payload, 300)
    except requests.exceptions.Timeout:
        return -1
    print r
    if r.status_code == 200:
        return len(r.json()['results']['bindings'])
    return -2


# def query(q, epr, f='application/json'):
def query(q, epr, f='application/sparql-results+json'):
    try:
        params = {'query': q}
        params = urllib.urlencode(params)
        opener = urllib2.build_opener(urllib2.HTTPHandler)
        request = urllib2.Request(epr + '?' + params)
        request.add_header('Accept', f)
        request.get_method = lambda: 'GET'
        url = opener.open(request, timeout=300)
        return len(json.loads(url.read())['results']['bindings'])
    except requests.exceptions.Timeout:
        return -1
    except Exception, e:
        print(e)
        traceback.print_exc(file=sys.stdout)
        return -2
        # traceback.print_exc(file=sys.stdout)
        # raise e


def main_parallel(command, sparql_server, query_folders, batch, cores):
    arglist = []
    AVAILABLE_CORES = int(cores)
    folder_number = 0
    for query_folder in sorted(glob.glob(query_folders + '/*')):
        print(query_folder)
        arglist.append((command, sparql_server, query_folder, batch, str(folder_number)))
        folder_number += 1

    print('Processing ' + str(folder_number) + ' files with ' +
          str(AVAILABLE_CORES) + ' cores, this may take a while...')
    pool = Pool(processes=AVAILABLE_CORES)
    pool.map_async(main, arglist).get()


def main((command, sparql_server, query_folder, batch, folder_number)):
    for query_file in sorted(glob.glob(query_folder + '/*.rq')):
        print('Query: ' + query_file)
        query_list_file_name = 'executed_queries_list_' + command + '_' + str(folder_number) + '.txt'
        with open(query_list_file_name, 'a') as query_list_file:
            with open('eval_endpoint_' + folder_number + '.csv', 'a') as results_file:
                query_list_file.write(query_file + '\n')
                try:
                    with open(query_file, 'r') as q:
                        content = q.read().strip()
                    # [queryFile,DEBUGtps,DEBUGfirstTime, DEBUGfirstHttp, DEBUGtime, DEBUGhttp, DEBUGdata, DEBUGtotal, 'TIMEOUT', timeoutInMins]
                    start = time.time()
                    print(start)
                    # result = run_query(content, sparql_server)
                    result = query(content, sparql_server)
                    run_time = time.time() - start
                    if result == -1:
                        # results_file.write('direct,{0},{1},{2}}\n'.format(query_file, result, 'TIMEOUT'))
                        results_file.write('direct,' + query_file + ',' + str(result) + ',' + str(run_time) + ',' + 'TIMEOUT' + '\n')
                    elif result == -2:
                        # results_file.write('direct,{0},{1},{2},{3}}\n'.format(query_file, result, run_time, 'ERROR'))
                        results_file.write('direct,' + query_file + ',' + str(result) + ',' + str(run_time) + ',' + 'ERROR' + '\n')
                    else:
                        results_file.write('direct,' + query_file + ',' + str(result) + ',' + str(run_time) + '\n')
                except Exception, e:
                    print(e)
                    results_file.write('direct,' + query_file + ',' + str(result) + ',' + str(run_time) + ',' + 'ERROR ' + str(e) + '\n')
                    # results_file.write('direct,{0},{1},{2},{3}}\n'.format(query_file, result, run_time, 'ERROR' + e))
                    traceback.print_exc(file=sys.stdout)


if __name__ == '__main__':
    if len(sys.argv) == 1:
        print('Usage: python eval.p query_folder')
    else:
        try:
            main_parallel(sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4], sys.argv[5])
            # main(sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4], sys.argv[5])
        except Exception, exc:
            print exc
            sys.exit()
        sys.exit()
