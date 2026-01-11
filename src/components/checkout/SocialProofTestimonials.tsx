import { useState, useEffect } from "react";
import { Star, User, Quote } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface SocialProof {
  id: string;
  product_id: string;
  type: string;
  author_name: string;
  author_avatar_url: string | null;
  content: string;
  is_active: boolean;
  position: number;
}

interface SocialProofTestimonialsProps {
  productId: string;
  isDarkTheme?: boolean;
  primaryColor?: string;
  className?: string;
}

// Track which testimonials have broken images
interface ImageErrorState {
  [testimonialId: string]: boolean;
}

const SocialProofTestimonials = ({
  productId,
  isDarkTheme = true,
  primaryColor = "#3b82f6",
  className,
}: SocialProofTestimonialsProps) => {
  const [testimonials, setTestimonials] = useState<SocialProof[]>([]);
  const [sectionTitle, setSectionTitle] = useState("O que dizem nossos clientes");
  const [loading, setLoading] = useState(true);
  const [imageErrors, setImageErrors] = useState<ImageErrorState>({});

  useEffect(() => {
    const fetchData = async () => {
      if (!productId) {
        setLoading(false);
        return;
      }

      try {
        // Fetch testimonials
        const { data: testimonialsData, error: testimonialsError } = await supabase
          .from("social_proofs")
          .select("*")
          .eq("product_id", productId)
          .eq("is_active", true)
          .order("position", { ascending: true });

        if (testimonialsError) {
          console.error("Error fetching social proofs:", testimonialsError);
        } else {
          setTestimonials(testimonialsData || []);
        }

        // Fetch section title
        const { data: settingsData } = await supabase
          .from("checkout_settings")
          .select("*")
          .eq("product_id", productId)
          .maybeSingle();

        if (settingsData && (settingsData as any).social_proof_title) {
          setSectionTitle((settingsData as any).social_proof_title);
        }
      } catch (err) {
        console.error("Error fetching data:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [productId]);

  // Don't render anything if loading or no testimonials
  if (loading || testimonials.length === 0) {
    return null;
  }

  const bgColor = isDarkTheme ? "bg-slate-800/50" : "bg-gray-50";
  const borderColor = isDarkTheme ? "border-slate-700/50" : "border-gray-200";
  const textColor = isDarkTheme ? "text-white" : "text-gray-900";
  const mutedColor = isDarkTheme ? "text-gray-400" : "text-gray-600";

  return (
    <div className={cn("space-y-3", className)}>
      {/* Header with emphasis */}
      <div className={cn(
        "flex items-center gap-3 p-3 rounded-lg",
        isDarkTheme ? "bg-blue-500/10 border border-blue-500/20" : "bg-blue-50 border border-blue-100"
      )}>
        <Quote className="w-5 h-5 text-blue-500" />
        <h4 className={cn("text-base font-semibold", textColor)}>
          {sectionTitle}
        </h4>
      </div>

      <div className="space-y-3">
        {testimonials.map((testimonial) => (
          <div
            key={testimonial.id}
            className={cn(
              "rounded-xl p-4 border-2 transition-all shadow-sm hover:shadow-md",
              isDarkTheme 
                ? "bg-gradient-to-br from-slate-800/80 to-slate-900/80 border-slate-600/50" 
                : "bg-gradient-to-br from-white to-gray-50 border-gray-200"
            )}
          >
            <div className="flex items-start gap-3">
              {/* Avatar */}
              <div className="shrink-0">
                {testimonial.author_avatar_url && !imageErrors[testimonial.id] ? (
                  <div className="w-10 h-10 rounded-full ring-2 ring-blue-500/30 overflow-hidden">
                    <img
                      src={testimonial.author_avatar_url}
                      alt={testimonial.author_name}
                      className="w-full h-full object-cover"
                      onError={() => {
                        setImageErrors(prev => ({ ...prev, [testimonial.id]: true }));
                      }}
                    />
                  </div>
                ) : (
                  <div
                    className={cn(
                      "w-10 h-10 rounded-full flex items-center justify-center ring-2 ring-blue-500/30",
                      isDarkTheme ? "bg-slate-700" : "bg-gray-100"
                    )}
                  >
                    <User className={cn("w-5 h-5", mutedColor)} />
                  </div>
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <span className={cn("font-semibold text-sm", textColor)}>
                    {testimonial.author_name}
                  </span>
                  {/* Star rating */}
                  <div className="flex gap-0.5">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        className="w-4 h-4 fill-amber-400 text-amber-400 drop-shadow-sm"
                      />
                    ))}
                  </div>
                </div>
                <p className={cn("text-sm leading-relaxed italic", mutedColor)}>
                  "{testimonial.content}"
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SocialProofTestimonials;
