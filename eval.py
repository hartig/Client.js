import traceback
import sys
import os
import glob
import subprocess
import shlex


def main(command, config_file, query_folder):
    for query_file in sorted(glob.glob(query_folder + '/*.rq')):
        print('Query: ' + query_file)
        #cmd = os.path.join(os.path.dirname(os.path.realpath(__file__)), 'bin/')
        cmd = './bin/' + command + ' -c ' + config_file + ' ' + os.path.join(os.path.dirname(os.path.realpath(__file__)), query_file)
        print('Command: ' + cmd)
        try:
            # command = Command(cmd)
            # command.run(timeout=302)
            tpf_process = subprocess.call(cmd, shell=True)
        except Exception, e:
            print(e)
            traceback.print_exc(file=sys.stdout)
        #ret = tpf_process.wait()
        #print('Return code TPF process: ' + str(ret))


if __name__ == '__main__':
    if len(sys.argv) == 1:
        print('Usage: python eval.py config_file query_folder')
    else:
        # (command, server, query_folder)
        main(sys.argv[1], sys.argv[2], sys.argv[3])

