const SUFFIXES = { t:1e12, g:1e9, meg:1e6, k:1e3, m:1e-3, u:1e-6, n:1e-9, p:1e-12, f:1e-15 };
const KINDS = { R:'resistor', C:'capacitor', L:'inductor', V:'voltage-source', I:'current-source', D:'diode' };

export class SpiceSyntaxError extends Error {
  constructor(diagnostics){super(diagnostics.map(d=>`Line ${d.line}: ${d.message}`).join('\n'));this.name='SpiceSyntaxError';this.diagnostics=diagnostics;}
}

export function parseSpiceValue(input){
  const match=String(input).trim().match(/^([+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)(meg|[tgkmunpf])?(?:[a-z]+)?$/i);
  if(!match) throw new Error(`Invalid SPICE value "${input}"`);
  return Number(match[1])*(match[2]?SUFFIXES[match[2].toLowerCase()]:1);
}

export function formatSpiceValue(value){
  if(!Number.isFinite(value)) throw new Error('Value must be finite');
  for(const [suffix,scale] of [['t',1e12],['g',1e9],['meg',1e6],['k',1e3],['m',1e-3],['u',1e-6],['n',1e-9],['p',1e-12],['f',1e-15]]){
    if(Math.abs(value)>=scale) return `${Number((value/scale).toPrecision(6))}${suffix}`;
  }
  return String(value);
}

export function parseSpice(text,{strict=true}={}){
  const lines=joinContinuations(String(text).replace(/\r\n?/g,'\n').split('\n'));
  const document={title:'Untitled netlist',components:[],directives:[],comments:[],diagnostics:[]};
  let titleSeen=false;
  lines.forEach(({text:raw,line})=>{
    const trimmed=raw.trim();
    if(!trimmed) return;
    if(trimmed.startsWith('*')){document.comments.push({line,text:trimmed.slice(1).trim()});return;}
    if(!titleSeen&&!trimmed.startsWith('.')){document.title=trimmed;titleSeen=true;return;}
    if(trimmed.startsWith('.')){document.directives.push({line,text:trimmed});return;}
    const clean=trimmed.split(/\s+\$/)[0];const tokens=clean.split(/\s+/);const name=tokens[0];const prefix=name?.[0]?.toUpperCase();
    if(!KINDS[prefix]){document.diagnostics.push({line,severity:'error',message:`Unsupported element "${name}"`});return;}
    if(tokens.length<4){document.diagnostics.push({line,severity:'error',message:`${name} requires two nodes and a value`});return;}
    try{
      const component={name,type:KINDS[prefix],nodes:[tokens[1],tokens[2]],raw:trimmed};
      if(prefix==='D'){component.model=tokens[3];component.parameters=parseParameters(tokens.slice(4));}
      else if(prefix==='V'||prefix==='I'){
        const valueToken=tokens[3]?.toUpperCase()==='DC'?tokens[4]:tokens[3];component.value=parseSpiceValue(valueToken);component.sourceType='dc';
      } else component.value=parseSpiceValue(tokens[3]);
      document.components.push(component);
    }catch(error){document.diagnostics.push({line,severity:'error',message:error.message});}
  });
  if(strict&&document.diagnostics.some(d=>d.severity==='error')) throw new SpiceSyntaxError(document.diagnostics);
  return document;
}

export function serializeSpice(document){
  const lines=[document.title||'OpenCircuit netlist'];
  for(const comment of document.comments||[]) lines.push(`* ${comment.text}`);
  for(const c of document.components||[]){
    if(c.type==='diode') lines.push(`${c.name} ${c.nodes[0]} ${c.nodes[1]} ${c.model}${serializeParameters(c.parameters)}`);
    else lines.push(`${c.name} ${c.nodes[0]} ${c.nodes[1]} ${c.sourceType==='dc'?'DC ':''}${formatSpiceValue(c.value)}`);
  }
  lines.push(...(document.directives||[]).map(d=>typeof d==='string'?d:d.text));
  if(!lines.some(line=>line.trim().toLowerCase()==='.end')) lines.push('.end');
  return `${lines.join('\n')}\n`;
}

export function toOpenCircuit(document){
  const nodes=[...new Set(document.components.flatMap(c=>c.nodes))];
  const ground=nodes.includes('0')?'0':nodes[0]||'0';
  return {format:'opencircuit',version:'1.0',metadata:{name:document.title||'Imported SPICE circuit'},ground,nodes:nodes.map(id=>({id})),components:document.components.map(c=>{
    const base={id:c.name,type:c.type,from:c.nodes[0],to:c.nodes[1]};
    if(c.type==='resistor') return {...base,resistance:c.value};if(c.type==='capacitor') return {...base,capacitance:c.value};if(c.type==='inductor') return {...base,inductance:c.value};
    if(c.type==='voltage-source') return {...base,voltage:c.value};if(c.type==='current-source') return {...base,current:c.value};return {...base,model:c.model};
  })};
}

function joinContinuations(lines){const result=[];lines.forEach((text,index)=>{if(/^\s*\+/.test(text)&&result.length) result.at(-1).text+=` ${text.replace(/^\s*\+\s*/,'')}`;else result.push({text,line:index+1});});return result;}
function parseParameters(tokens){return Object.fromEntries(tokens.map(token=>token.split('=')).filter(parts=>parts.length===2));}
function serializeParameters(parameters){const entries=Object.entries(parameters||{});return entries.length?` ${entries.map(([k,v])=>`${k}=${v}`).join(' ')}`:'';}
