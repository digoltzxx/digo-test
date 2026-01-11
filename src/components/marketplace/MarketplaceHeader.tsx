import { Flame } from "lucide-react";

interface MarketplaceHeaderProps {
  title: string;
  subtitle: string;
  productCount: number;
}

const MarketplaceHeader = ({ title, subtitle, productCount }: MarketplaceHeaderProps) => {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <Flame className="w-5 h-5 text-orange-500" />
          {title}
        </h1>
        <p className="text-gray-500 text-sm">{subtitle}</p>
      </div>
      <span className="text-cyan-400 text-sm font-medium">
        {productCount} produtos encontrados
      </span>
    </div>
  );
};

export default MarketplaceHeader;
