import logoImage from "@/assets/logo-royalpay.png";

const Logo = () => {
  return (
    <div className="flex items-center gap-2">
      <img src={logoImage} alt="Royal Pay" className="h-8 w-auto" />
    </div>
  );
};

export default Logo;