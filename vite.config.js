import path from 'node:path';
const deps = process.env.SILENCIO_DEPS || path.resolve('node_modules');
export default {
 base: './',
 resolve:{alias:[{find:/^three$/,replacement:path.join(deps,'three/build/three.module.js')},{find:'three/addons',replacement:path.join(deps,'three/examples/jsm')}]},
 build:{outDir:'build',chunkSizeWarningLimit:750,emptyOutDir:false},
 server:{watch:{usePolling:true,interval:350},fs:{allow:[process.cwd(),deps]}}
};


