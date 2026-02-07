export type AdminSearchParams = {
  q?: string;
  status?: string;
  page?: string;
  pageSize?: string;
  sort?: string;
};

export function parseAdminOptions(params: AdminSearchParams) {
  const page = Number.parseInt(params.page ?? "", 10);
  const pageSize = Number.parseInt(params.pageSize ?? "", 10);
  return {
    query: params.q ?? "",
    status: params.status ?? "All",
    page: Number.isFinite(page) && page > 0 ? page : 1,
    pageSize: Number.isFinite(pageSize) && pageSize > 0 ? pageSize : 10,
    sort: params.sort === "asc" ? ("asc" as const) : ("desc" as const),
  };
}

export function adminOptionsFromUrl(url: string) {
  const searchParams = new URL(url).searchParams;
  return parseAdminOptions({
    q: searchParams.get("q") ?? undefined,
    status: searchParams.get("status") ?? undefined,
    page: searchParams.get("page") ?? undefined,
    pageSize: searchParams.get("pageSize") ?? undefined,
    sort: searchParams.get("sort") ?? undefined,
  });
}
