// Load .dev.vars via Node's --env-file-if-exists, then pass secrets only through the child environment.
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const child=spawn(process.env.PYTHON||'python3',['-m','scripts.consistency.cli',...process.argv.slice(2)],{
  cwd:fileURLToPath(new URL('../',import.meta.url)),stdio:'inherit',env:process.env
});
child.on('error',()=>{console.error('Python 3.10+ is required for the consistency pipeline.');process.exitCode=1;});
child.on('exit',code=>{process.exitCode=code??1;});
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>child.kill(signal));
