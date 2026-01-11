// Update this page (the content is just a fallback if you fail to update the page)

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-10 sm:px-6 lg:px-8">
        <header className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Bloco de Notas</h1>
          <p className="max-w-xl text-sm text-muted-foreground">
            Digite seu texto abaixo. O conteúdo não é salvo: se você recarregar ou fechar a página, ele será perdido.
          </p>
        </header>

        <section className="space-y-3">
          <div>
            <label htmlFor="note-title" className="block text-sm font-medium text-foreground">
              Nome da nota
            </label>
            <input
              id="note-title"
              type="text"
              placeholder="Sem título"
              className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            />
          </div>

          <div>
            <label htmlFor="note-body" className="block text-sm font-medium text-foreground">
              Anotações
            </label>
            <textarea
              id="note-body"
              placeholder="Escreva aqui..."
              className="mt-1 block min-h-[280px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm leading-relaxed shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            />
          </div>
        </section>

        <p className="text-xs text-muted-foreground">
          Aviso: este é apenas um experimento rápido. Nada é salvo depois que você fecha ou recarrega a página.
        </p>
      </main>
    </div>
  );
};

export default Index;
