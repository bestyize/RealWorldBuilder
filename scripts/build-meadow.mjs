import {build} from 'esbuild';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url));
await build({absWorkingDir:root,entryPoints:['src/meadow/main.js'],outfile:'scenes/meadow/viewer.js',format:'iife',bundle:true,minify:true,legalComments:'inline'});
