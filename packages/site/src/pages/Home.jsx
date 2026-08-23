import Header from '../components/Header';
import Hero from '../components/Hero';
import SectionDor from '../sections/SectionDor';
import SectionSolucao from '../sections/SectionSolucao';
import SectionComoFunciona from '../sections/SectionComoFunciona';
import SectionComparativo from '../sections/SectionComparativo';
import SectionOrigem from '../sections/SectionOrigem';
import Pricing from '../sections/Pricing';
import FAQ from '../sections/FAQ';
import CTABlock from '../sections/CTABlock';
import Footer from '../sections/Footer';

// Ordem exatamente igual a do site original:
// Header, Hero, Dor, Solucao, ComoFunciona, Comparativo, Origem, Pricing,
// FAQ, CTA, Footer.
export default function Home() {
  return (
    <div className="relative min-h-screen w-full overflow-x-hidden">
      <Header />
      <Hero />
      <SectionDor />
      <SectionSolucao />
      <SectionComoFunciona />
      <SectionComparativo />
      <SectionOrigem />
      <Pricing />
      <FAQ />
      <CTABlock />
      <Footer />
    </div>
  );
}
