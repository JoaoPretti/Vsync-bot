function normalizarEspacos(texto) {
  return texto.replace(/\s+/g, ' ').trim();
}

function capitalizarNomePersonagem(nome) {
  return normalizarEspacos(nome)
    .split(' ')
    .filter(Boolean)
    .map((parte) => parte.charAt(0).toUpperCase() + parte.slice(1).toLowerCase())
    .join(' ');
}

function sanitizarNomeCanal(nome) {
  return nome
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

function gerarNomeCanalCadastro(nomeFormatado, personagemId) {
  return `🗂️・${sanitizarNomeCanal(nomeFormatado)}・${personagemId}`.slice(0, 100);
}

function formatarMoeda(valor) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(valor || 0));
}

function possuiExtensaoImagem(url) {
  return /\.(png|jpe?g|gif|webp|bmp|svg)(?:\?.*)?$/i.test(url);
}

function extrairImagemHtml(html, urlBase) {
  const expressoes = [
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["']/i,
  ];

  for (const expressao of expressoes) {
    const correspondencia = html.match(expressao);

    if (correspondencia?.[1]) {
      return new URL(correspondencia[1], urlBase).toString();
    }
  }

  return null;
}

async function resolverUrlImagem(urlInformada) {
  if (!urlInformada) {
    return null;
  }

  let url;

  try {
    url = new URL(urlInformada);
  } catch {
    return null;
  }

  if (possuiExtensaoImagem(url.toString())) {
    return url.toString();
  }

  if (url.hostname === 'postimg.cc') {
    const partes = url.pathname.split('/').filter(Boolean);

    if (partes.length >= 2) {
      return `https://i.postimg.cc/${partes[0]}/${partes[1]}`;
    }
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const resposta = await fetch(url.toString(), {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'user-agent': 'Mozilla/5.0 VSYNC-Bot',
      },
    });

    if (!resposta.ok) {
      return url.toString();
    }

    const contentType = resposta.headers.get('content-type') || '';

    if (contentType.startsWith('image/')) {
      return resposta.url;
    }

    if (contentType.includes('text/html')) {
      const html = await resposta.text();
      const imagemExtraida = extrairImagemHtml(html, resposta.url);

      if (imagemExtraida) {
        return imagemExtraida;
      }
    }

    return url.toString();
  } catch (error) {
    console.error(`[resolverUrlImagem] Não foi possível resolver a URL ${urlInformada}:`, error);
    return url.toString();
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = {
  capitalizarNomePersonagem,
  formatarMoeda,
  gerarNomeCanalCadastro,
  normalizarEspacos,
  resolverUrlImagem,
};
