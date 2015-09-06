from multiprocessing import Pool
import traceback
import sys
import os
import glob
import subprocess


AVAILABLE_CORES = 10


def eval_parallel(command, server, query_folder):
    arglist = []
    total_counter = 0
    for query_dir in sorted(glob.glob(query_folder + '/*')):
        print(query_folder)
        for query_file in sorted(glob.glob(query_dir + '/*')):
            print(command, server, query_file)
            arglist.append((command, server, query_file))
    print('Processing ' + str(total_counter) + ' queries ' +
          str(AVAILABLE_CORES) + ' cores, this may take a while...')
    pool = Pool(processes=AVAILABLE_CORES)
    pool.map_async(main, arglist).get()


# def run_command((command, server, query_file)):
#     print('Query: ' + query_file)
#     cmd = os.path.join(os.path.dirname(os.path.realpath(__file__)), 'eval_query.sh ')
#     cmd += command + ' ' + server + ' ' + os.path.join(os.path.dirname(os.path.realpath(__file__)), query_file)
#     try:
#         tpf_process = subprocess.Popen(shlex.split(cmd), stdout=subprocess.PIPE)
#     except Exception, e:
#         print(e)
#         traceback.print_exc(file=sys.stdout)
#     ret = tpf_process.wait()
#     print('Return code TPF process: ' + str(ret))


def main((command, config_file, query_file)):
    # for query_file in sorted(glob.glob(query_folder + '/*.rq')):
    print('Query: ' + query_file)
    cmd = './bin/' + command + ' -c ' + config_file + ' ' + os.path.join(os.path.dirname(os.path.realpath(__file__)), query_file)
    print('Command: ' + cmd)
    try:
        subprocess.call(cmd, shell=True)
    except Exception, e:
        print(e)
        traceback.print_exc(file=sys.stdout)


if __name__ == '__main__':
    if len(sys.argv) == 1:
        print('Usage: python TPF_command config_file query_folder')
    else:
        eval_parallel(sys.argv[1], sys.argv[2], sys.argv[3])
