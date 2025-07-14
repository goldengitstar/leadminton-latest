
// Imports
import * as R0M0 from "@api/root/src/server/api/monitor/index.ts";
import * as R0M1 from "@api/root/src/server/api/resource/index.ts";
import * as configure from "@api/configure";

export const routeBase = "/api";

const internal  = [
  R0M0.default && {
        source     : "src/server/api/monitor/index.ts?fn=default",
        method     : "use",
        route      : "/monitor/",
        path       : "/api/monitor/",
        url        : "/api/monitor/",
        cb         : R0M0.default,
      },
  R0M0.GET && {
        source     : "src/server/api/monitor/index.ts?fn=GET",
        method     : "get",
        route      : "/monitor/",
        path       : "/api/monitor/",
        url        : "/api/monitor/",
        cb         : R0M0.GET,
      },
  R0M0.PUT && {
        source     : "src/server/api/monitor/index.ts?fn=PUT",
        method     : "put",
        route      : "/monitor/",
        path       : "/api/monitor/",
        url        : "/api/monitor/",
        cb         : R0M0.PUT,
      },
  R0M0.POST && {
        source     : "src/server/api/monitor/index.ts?fn=POST",
        method     : "post",
        route      : "/monitor/",
        path       : "/api/monitor/",
        url        : "/api/monitor/",
        cb         : R0M0.POST,
      },
  R0M0.PATCH && {
        source     : "src/server/api/monitor/index.ts?fn=PATCH",
        method     : "patch",
        route      : "/monitor/",
        path       : "/api/monitor/",
        url        : "/api/monitor/",
        cb         : R0M0.PATCH,
      },
  R0M0.DELETE && {
        source     : "src/server/api/monitor/index.ts?fn=DELETE",
        method     : "delete",
        route      : "/monitor/",
        path       : "/api/monitor/",
        url        : "/api/monitor/",
        cb         : R0M0.DELETE,
      },
  R0M1.default && {
        source     : "src/server/api/resource/index.ts?fn=default",
        method     : "use",
        route      : "/resource/",
        path       : "/api/resource/",
        url        : "/api/resource/",
        cb         : R0M1.default,
      },
  R0M1.GET && {
        source     : "src/server/api/resource/index.ts?fn=GET",
        method     : "get",
        route      : "/resource/",
        path       : "/api/resource/",
        url        : "/api/resource/",
        cb         : R0M1.GET,
      },
  R0M1.PUT && {
        source     : "src/server/api/resource/index.ts?fn=PUT",
        method     : "put",
        route      : "/resource/",
        path       : "/api/resource/",
        url        : "/api/resource/",
        cb         : R0M1.PUT,
      },
  R0M1.POST && {
        source     : "src/server/api/resource/index.ts?fn=POST",
        method     : "post",
        route      : "/resource/",
        path       : "/api/resource/",
        url        : "/api/resource/",
        cb         : R0M1.POST,
      },
  R0M1.PATCH && {
        source     : "src/server/api/resource/index.ts?fn=PATCH",
        method     : "patch",
        route      : "/resource/",
        path       : "/api/resource/",
        url        : "/api/resource/",
        cb         : R0M1.PATCH,
      },
  R0M1.DELETE && {
        source     : "src/server/api/resource/index.ts?fn=DELETE",
        method     : "delete",
        route      : "/resource/",
        path       : "/api/resource/",
        url        : "/api/resource/",
        cb         : R0M1.DELETE,
      }
].filter(it => it);

export const routers = internal.map((it) => {
  const { method, path, route, url, source } = it;
  return { method, url, path, route, source };
});

export const endpoints = internal.map(
  (it) => it.method?.toUpperCase() + "\t" + it.url
);

export const applyRouters = (applyRouter) => {
  internal.forEach((it) => {
    it.cb = configure.callbackBefore?.(it.cb, it) || it.cb;
    applyRouter(it);
  });
};

