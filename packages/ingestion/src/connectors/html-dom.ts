import { parse, serialize, type DefaultTreeAdapterTypes } from 'parse5';

export type HtmlElement = DefaultTreeAdapterTypes.Element;
type HtmlNode = DefaultTreeAdapterTypes.Node;

export function documentOf(html:string):HtmlNode { return parse(html); }

export function descendants(node:HtmlNode, predicate:(element:HtmlElement)=>boolean):HtmlElement[] {
  const found:HtmlElement[]=[];
  const visit=(current:HtmlNode):void=>{
    if('tagName' in current && predicate(current)) found.push(current);
    if('childNodes' in current) for(const child of current.childNodes) visit(child);
  };
  visit(node);
  return found;
}

export function attribute(element:HtmlElement,name:string):string|null {
  return element.attrs.find(item=>item.name===name)?.value??null;
}

export function hasClass(element:HtmlElement,name:string):boolean {
  return (attribute(element,'class')??'').split(/\s+/).includes(name);
}

export function textOf(node:HtmlNode):string {
  const parts:string[]=[];
  const visit=(current:HtmlNode):void=>{
    if('value' in current) parts.push(current.value);
    if('childNodes' in current) for(const child of current.childNodes) visit(child);
  };
  visit(node);
  return parts.join(' ').replace(/\s+/g,' ').trim();
}

export function innerHtml(element:HtmlElement):string { return serialize(element); }
