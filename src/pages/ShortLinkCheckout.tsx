import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import NotFound from "./NotFound";

// List of known routes that should NOT be treated as short codes
const RESERVED_ROUTES = [
  "login", "cadastro", "checkout", "dashboard", "admin", "gerente", "aluno",
  "funcionalidades", "taxas", "area-membros", "integracoes", "sobre", "blog",
  "carreiras", "contato", "central-ajuda", "documentacao", "status", "api",
  "offer", "p", "c"
];

const ShortLinkCheckout = () => {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    const resolveShortCode = async () => {
      if (!code) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      // Check if this is a reserved route
      if (RESERVED_ROUTES.includes(code.toLowerCase())) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      // Validate code format (6-12 alphanumeric characters)
      if (!/^[A-Za-z0-9]{6,12}$/.test(code)) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      try {
        // Find product link by short code
        const { data: linkData, error: linkError } = await supabase
          .rpc("find_product_link_by_code", { code });

        if (linkError) {
          console.error("Error finding link:", linkError);
          setNotFound(true);
          setLoading(false);
          return;
        }

        if (!linkData || linkData.length === 0) {
          setNotFound(true);
          setLoading(false);
          return;
        }

        const link = linkData[0];
        
        // Increment click count (fire and forget)
        supabase
          .from("product_links")
          .select("clicks")
          .eq("id", link.id)
          .single()
          .then(({ data }) => {
            supabase
              .from("product_links")
              .update({ clicks: (data?.clicks || 0) + 1 })
              .eq("id", link.id)
              .then(() => {});
          });

        // Get product short ID
        const productShortId = link.product_id.slice(0, 8);
        
        // Build redirect URL with custom price if set
        let redirectUrl = `/p/${productShortId}/${link.slug}`;
        
        // Add UTM params if present
        const params = new URLSearchParams();
        if (link.utm_source) params.set("utm_source", link.utm_source);
        if (link.utm_medium) params.set("utm_medium", link.utm_medium);
        if (link.utm_campaign) params.set("utm_campaign", link.utm_campaign);
        
        const queryString = params.toString();
        if (queryString) {
          redirectUrl += `?${queryString}`;
        }

        // Navigate to the actual checkout
        navigate(redirectUrl, { replace: true });
      } catch (err) {
        console.error("Error resolving short code:", err);
        setNotFound(true);
        setLoading(false);
      }
    };

    resolveShortCode();
  }, [code, navigate]);

  if (notFound) {
    return <NotFound />;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Carregando checkout...</p>
        </div>
      </div>
    );
  }

  return null;
};

export default ShortLinkCheckout;
