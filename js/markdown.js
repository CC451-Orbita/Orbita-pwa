/* Formato de las respuestas de IA. El contenido del proveedor es texto externo. */
(function () {
  const md = window.markdownit({ html: false, linkify: false }).disable('image');

  function analizar(texto) {
    const entorno = {};
    let tokens = md.parse(texto, entorno);
    const bloque = tokens[0];
    if (tokens.length === 1 && bloque.type === 'fence' && /^(?:markdown|md)$/i.test(bloque.info.trim())) {
      tokens = md.parse(bloque.content, entorno);
    }
    return { tokens, entorno };
  }

  function contenido(token) {
    return token.children.map(hijo =>
      hijo.type === 'softbreak' || hijo.type === 'hardbreak' ? ' ' : hijo.content
    ).join('');
  }

  function textoPlano(texto) {
    const { tokens } = analizar(texto);
    return tokens.map(token => {
      if (token.type === 'inline') return contenido(token);
      if (token.type === 'fence' || token.type === 'code_block') return token.content;
      return '';
    }).join(' ').replace(/\s+/g, ' ').trim();
  }

  function seccionesResumen(texto) {
    const { tokens, entorno } = analizar(texto);
    const secciones = { decisiones: [], abiertos: [] };
    let seccion = null;
    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      if (token.level === 0 && (token.type === 'heading_open' || token.type === 'paragraph_open')) {
        const titulo = contenido(tokens[i + 1])
          .replace(/^[\s\p{Extended_Pictographic}\uFE0F]+/u, '')
          .replace(/\s*:\s*$/, '').trim().toLowerCase();
        if (titulo === 'decisiones' || titulo === 'temas abiertos') {
          seccion = titulo === 'decisiones' ? secciones.decisiones : secciones.abiertos;
          i += 2;
          continue;
        }
      }
      if (seccion) seccion.push(token);
    }
    const renderizar = lista => md.renderer.render(lista, md.options, entorno);
    if (!seccion) return { completo: renderizar(tokens) };
    return { decisiones: renderizar(secciones.decisiones), abiertos: renderizar(secciones.abiertos) };
  }

  window.Markdown = { seccionesResumen, textoPlano };
})();
