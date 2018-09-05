import traceback
import sys
import os
import glob
import subprocess
from multiprocessing import Pool


def main_parallel(command, start_fragment, config_file, query_folders, batch, cores):
    arglist = []
    AVAILABLE_CORES = int(cores)
    folder_number = 0
    for query_folder in sorted(glob.glob(query_folders + '/*')):
        print(query_folder)
        arglist.append((command, start_fragment, config_file, query_folder, batch, folder_number))
        folder_number += 1

    print('Processing ' + str(folder_number) + ' files with ' +
          str(AVAILABLE_CORES) + ' cores, this may take a while...')
    pool = Pool(processes=AVAILABLE_CORES)
    pool.map_async(main, arglist).get()


def main((command, start_fragment, config_file, query_folder, batch, folder_number)):
    for query_file in sorted(glob.glob(query_folder + '/*.rq')):
        print('Query: ' + query_file)
        query_list_file_name = 'executed_queries_list_' +  command + '_' + str(folder_number) + '.txt'
        with open(query_list_file_name, 'a') as query_list_file:
            query_list_file.write(query_file + '\n')
            cmd = 'bin/' + command + ' ' + start_fragment + ' -c ' + config_file + ' -f ' + os.path.join(os.path.dirname(os.path.realpath(__file__)), query_file + ' --maxNumberOfMappings ' + batch  + ' --outputFileNumber ' + str(folder_number))
            print('Command: ' + cmd)
            try:
                subprocess.call(cmd, shell=True)
            except Exception, e:
                print(e)
                traceback.print_exc(file=sys.stdout)


if __name__ == '__main__':
    if len(sys.argv) == 1:
        print('Usage: python eval.py config_file query_folder')
    else:
        try:
            main_parallel(sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4], sys.argv[5], sys.argv[6])
        except Exception, exc:
            print exc
            sys.exit()
        sys.exit()

