// Windows sandbox may deny os.userInfo; only the tsx temporary directory label needs it.
const os=require('node:os');try{os.userInfo()}catch{os.userInfo=()=>({username:'potok-local',homedir:process.cwd(),uid:-1,gid:-1,shell:null})}
process.argv=[process.argv[0],require.resolve('../node_modules/drizzle-kit/bin.cjs'),'generate'];require('../node_modules/drizzle-kit/bin.cjs');

