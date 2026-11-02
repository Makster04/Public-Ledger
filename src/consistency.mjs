// Read-only access to the Python worker's atomically published report. Model calls never run on a page request.
export function selectConsistencyReport(data,id){
  if(data?.schema_version!==1||!data.people||typeof data.people!=='object')throw new Error('Unsupported consistency report');
  const person=Object.hasOwn(data.people,id)?data.people[id]:null;
  return {schema_version:1,available:!!person,generated_at:data.generated_at||null,methodology:data.methodology||{},person};
}

export async function getConsistency(env,id,origin='https://public-ledger.invalid'){
  if(typeof id!=='string'||!/^[a-zA-Z0-9_-]{1,100}$/.test(id))return {schema_version:1,available:false,person:null};
  const response=await env.ASSETS.fetch(new Request(new URL('/consistency.json',origin)));
  if(response.status===404)return {schema_version:1,available:false,person:null};
  if(!response.ok)throw new Error('Consistency report unavailable');
  return selectConsistencyReport(await response.json(),id);
}
