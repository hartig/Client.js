import traceback
import sys
import os
import glob
import subprocess
import signal
from multiprocessing import Pool


def handler(signum, frame):
    print "Forever is over!"
    raise Exception("end of time")


def main_parallel(command, start_fragment, config_file, query_folders, batch):
    arglist = []
    AVAILABLE_CORES = 22
    cnt = 0
    for query_folder in sorted(glob.glob(query_folders)):
        arglist.append(command, start_fragment, config_file, query_folder, batch)
        cnt += 1
        if cnt == AVAILABLE_CORES:
            break;

    print('Processing ' + str(cnt) + ' files with ' +
          str(AVAILABLE_CORES) + ' cores, this may take a while...')
    pool = Pool(processes=AVAILABLE_CORES)
    pool.map_async(main, arglist).get()


def main((command, start_fragment, config_file, query_folder, batch)):
    for query_file in sorted(glob.glob(query_folder + '/*.rq')):
        print('Query: ' + query_file)
        cmd = './bin/' + command + ' ' + start_fragment + ' -c ' + config_file + ' -f ' + os.path.join(os.path.dirname(os.path.realpath(__file__)), query_file + ' --maxNumberOfMappings ' + batch)
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
        # (command, server, query_folder)
        signal.signal(signal.SIGALRM, handler)
        signal.alarm(360)
        try:
            main(sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4], sys.argv[5])
        except Exception, exc:
            print exc
            sys.exit()
        sys.exit()

