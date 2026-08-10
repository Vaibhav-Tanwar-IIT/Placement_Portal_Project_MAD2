/* Thin fetch wrapper around the Flask REST API. */
window.API = (function () {
  const TOKEN_KEY = "pp_token";

  function token() {
    return localStorage.getItem(TOKEN_KEY);
  }

  function setToken(value) {
    if (value) localStorage.setItem(TOKEN_KEY, value);
    else localStorage.removeItem(TOKEN_KEY);
  }

  async function request(method, url, body) {
    const headers = { "Content-Type": "application/json" };
    const t = token();
    if (t) headers["Authorization"] = "Bearer " + t;

    let res;
    try {
      res = await fetch(url, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch (e) {
      throw new Error("Cannot reach the server. Is the Flask app running?");
    }

    let data = {};
    const text = await res.text();
    if (text) {
      try { data = JSON.parse(text); } catch (e) { data = { message: text }; }
    }

    if (!res.ok) {
      if (res.status === 401) {
        setToken(null);
        if (!location.hash.startsWith("#/login")) location.hash = "#/login";
      }
      const err = new Error(data.message || `Request failed (${res.status})`);
      err.status = res.status;
      throw err;
    }
    return data;
  }

  return {
    token,
    setToken,
    get: (u) => request("GET", u),
    post: (u, b) => request("POST", u, b || {}),
    put: (u, b) => request("PUT", u, b || {}),
    del: (u) => request("DELETE", u),
  };
})();
