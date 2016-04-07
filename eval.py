import traceback
import sys
import os
import glob
import subprocess
import signal


class Timeout():
    """Timeout class using ALARM signal"""
    class Timeout(Exception):
        pass

    def __init__(self, sec):
        self.sec = sec

    def __enter__(self):
        signal.signal(signal.SIGALRM, self.raise_timeout)
        signal.alarm(self.sec)

    def __exit__(self, *args):
        signal.alarm(0)  # disable alarm

    def raise_timeout(self, *args):
        raise Timeout.Timeout()


def main(command, start_fragment, config_file, query_folder, batch):
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
        try:
            with Timeout(3):
                main(sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4], sys.argv[5])
        except Timeout.Timeout:
            print "Timeout"
            sys.exit()
        sys.exit()
