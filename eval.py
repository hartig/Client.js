import traceback
import sys
import os
import glob
import subprocess


def main(command, start_fragment, config_file, query_folder):
    for query_file in sorted(glob.glob(query_folder + '/*.rq')):
        print('Query: ' + query_file)
        cmd = './bin/' + command + ' ' + start_fragment + ' -c ' + config_file + ' -f ' + os.path.join(os.path.dirname(os.path.realpath(__file__)), query_file)
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
        main(sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4])

