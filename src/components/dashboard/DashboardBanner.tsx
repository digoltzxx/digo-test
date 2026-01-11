import { Loader2 } from "lucide-react";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  type CarouselApi,
} from "@/components/ui/carousel";
import Autoplay from "embla-carousel-autoplay";

interface BannerSlide {
  id: string;
  image_url: string;
  link_url: string | null;
  alt_text: string | null;
  position: number;
  is_active: boolean;
}

// Pixel-perfect dimensions: 2048 x 342px (ratio ~6:1)
const BANNER_ASPECT_RATIO = 2048 / 342;

const DashboardBanner = () => {
  const [loading, setLoading] = useState(true);
  const [slides, setSlides] = useState<BannerSlide[]>([]);
  const [api, setApi] = useState<CarouselApi>();
  const [current, setCurrent] = useState(0);
  const [imageErrors, setImageErrors] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchSlides();
    
    const channel = supabase
      .channel('banner-slides')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'banner_slides' }, () => {
        fetchSlides();
      })
      .subscribe();
    
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    if (!api) return;

    setCurrent(api.selectedScrollSnap());

    api.on("select", () => {
      setCurrent(api.selectedScrollSnap());
    });
  }, [api]);

  const fetchSlides = async () => {
    try {
      const { data, error } = await supabase
        .from('banner_slides')
        .select('id, image_url, link_url, alt_text, position, is_active')
        .eq('is_active', true)
        .neq('image_url', '')
        .order('position', { ascending: true });

      if (error) throw error;
      setSlides(data || []);
      setImageErrors(new Set());
    } catch (error) {
      console.error('Error fetching banner slides:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleBannerClick = useCallback((linkUrl: string | null) => {
    if (linkUrl) {
      window.open(linkUrl, '_blank', 'noopener,noreferrer');
    }
  }, []);

  const goToSlide = useCallback((index: number) => {
    api?.scrollTo(index);
  }, [api]);

  const handleImageError = useCallback((id: string) => {
    setImageErrors(prev => new Set(prev).add(id));
  }, []);

  if (loading) {
    return (
      <div 
        className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-muted/50 via-muted to-muted/50 flex items-center justify-center"
        style={{ aspectRatio: BANNER_ASPECT_RATIO }}
      >
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Filter out slides with image errors
  const validSlides = slides.filter(slide => !imageErrors.has(slide.id));

  // Don't render if no active banners
  if (validSlides.length === 0) {
    return null;
  }

  // Render single banner item
  const renderBanner = (slide: BannerSlide) => (
    <div 
      className={`
        relative overflow-hidden rounded-2xl w-full
        ${slide.link_url ? 'cursor-pointer hover:opacity-95 transition-opacity' : ''}
      `}
      style={{ aspectRatio: BANNER_ASPECT_RATIO }}
      onClick={() => handleBannerClick(slide.link_url)}
    >
      {/* 
        Pixel-perfect image display:
        - Desktop: full width, original aspect ratio
        - Tablet/Mobile: same ratio, responsive height
        - object-cover ensures center crop without distortion
        - object-center keeps focus on center of banner
      */}
      <img 
        src={slide.image_url} 
        alt={slide.alt_text || 'Banner promocional'}
        className="absolute inset-0 w-full h-full object-cover object-center"
        onError={() => handleImageError(slide.id)}
        loading="eager"
        decoding="async"
      />
      
      {/* Fallback placeholder shown on error */}
      {imageErrors.has(slide.id) && (
        <div className="absolute inset-0 bg-gradient-to-r from-muted/80 via-muted to-muted/80 flex items-center justify-center">
          <span className="text-muted-foreground text-sm">Imagem indisponível</span>
        </div>
      )}
    </div>
  );

  // Single banner - no carousel needed
  if (validSlides.length === 1) {
    return renderBanner(validSlides[0]);
  }

  // Multiple banners - show carousel
  return (
    <Carousel
      opts={{
        align: "start",
        loop: true,
      }}
      plugins={[
        Autoplay({
          delay: 5000,
          stopOnInteraction: false,
          stopOnMouseEnter: true,
          playOnInit: true,
        }),
      ]}
      setApi={setApi}
      className="w-full group"
    >
      <CarouselContent className="-ml-0">
        {validSlides.map((slide) => (
          <CarouselItem key={slide.id} className="pl-0">
            {renderBanner(slide)}
          </CarouselItem>
        ))}
      </CarouselContent>
      
      {/* Navigation Arrows - appear on hover */}
      <CarouselPrevious 
        className="left-2 md:left-4 opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-black/30 hover:bg-black/50 border-0 text-white" 
      />
      <CarouselNext 
        className="right-2 md:right-4 opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-black/30 hover:bg-black/50 border-0 text-white" 
      />
      
      {/* Position Indicators */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-2">
        {validSlides.map((_, index) => (
          <button 
            key={index}
            onClick={(e) => {
              e.stopPropagation();
              goToSlide(index);
            }}
            className={`h-2 rounded-full transition-all duration-300 ${
              current === index 
                ? 'bg-white w-6 shadow-md' 
                : 'bg-white/50 hover:bg-white/75 w-2'
            }`}
            aria-label={`Ir para banner ${index + 1}`}
          />
        ))}
      </div>
    </Carousel>
  );
};

export default DashboardBanner;