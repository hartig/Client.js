from multiprocessing import Pool
import traceback
import sys
import os
import glob
import subprocess
import shlex
import threading


AVAILABLE_CORES = 10

# _TPF_CLIENT_COMMAND = '''results=$(timeout %s %s %s %s
#     | tee >(grep 'Request\s#' | wc -l
#         | awk  '{ print "Requests: "$1}') >(grep 'Result #' | wc -l
#         | awk  '{ print "Results: "$1}') >(grep 'First Result Time'
#         | awk  '{ print "Time: "$4}' ) )'''


class Command(object):
    def __init__(self, cmd):
        self.cmd = cmd
        self.process = None

    def run(self, timeout):
        def target():
            print 'Thread started'
            self.process = subprocess.Popen(self.cmd, shell=True)
            self.process.communicate()
            print 'Thread finished'

        thread = threading.Thread(target=target)
        thread.start()

        thread.join(timeout)
        if thread.is_alive():
            print 'Terminating process'
            self.process.terminate()
            thread.join()
        print self.process.returncode


def eval_parallel(command, server, query_folder):
    arglist = []
    total_counter = 0
    for query_file in sorted(glob.glob(query_folder + '/*')):
        print(command, server, query_file)
        arglist.append((command, server, query_file))
    print('Processing ' + str(total_counter) + ' queries ' +
          str(AVAILABLE_CORES) + ' cores, this may take a while...')
    pool = Pool(processes=AVAILABLE_CORES)
    pool.map_async(main, arglist).get()


def run_command((command, server, query_file)):
    print('Query: ' + query_file)
    cmd = os.path.join(os.path.dirname(os.path.realpath(__file__)), 'eval_query.sh ')
    cmd += command + ' ' + server + ' ' + os.path.join(os.path.dirname(os.path.realpath(__file__)), query_file)
    try:
        tpf_process = subprocess.Popen(shlex.split(cmd), stdout=subprocess.PIPE)
    except Exception, e:
        print(e)
        traceback.print_exc(file=sys.stdout)
    ret = tpf_process.wait()
    print('Return code TPF process: ' + str(ret))


def main(command, server, query_folder):
    for query_file in sorted(glob.glob(query_folder + '/*.rq')):
        print('Query: ' + query_file)
        cmd = os.path.join(os.path.dirname(os.path.realpath(__file__)), 'eval_query.sh ')
        cmd += command + ' ' + server + ' ' + os.path.join(os.path.dirname(os.path.realpath(__file__)), query_file)
        try:
            command = Command(cmd)
            command.run(timeout=301000)
            # tpf_process = subprocess.Popen(shlex.split(cmd), stdout=subprocess.PIPE)
        except Exception, e:
            print(e)
            traceback.print_exc(file=sys.stdout)
        # ret = tpf_process.wait()
        # print('Return code TPF process: ' + str(ret))


if __name__ == '__main__':
    if len(sys.argv) == 1:
        print('Usage: python eval_parallel.py config_file query_folder')
    else:
        # (command, server, query_folder)
        eval_parallel(sys.argv[1], sys.argv[2], sys.argv[3])
