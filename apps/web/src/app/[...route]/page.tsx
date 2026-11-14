import { ProductPage } from "@/components/product";
export default async function Page({ params }: { params: Promise<{ route: string[] }> }) { const { route } = await params; return <ProductPage route={route} />; }
