const DISCLAIMER_TEXT = [
  "Coach est un outil d'information et d'organisation de l'entraînement. Il ne remplace pas un avis médical ni un professionnel du sport ou de la nutrition.",
  "Consulte un médecin avant de démarrer un programme exigeant, après une longue période d'arrêt, ou en cas de douleur, d'essoufflement inhabituel, de malaise ou de pathologie.",
  "Les repères de charge, d'allure et de nutrition sont des repères généraux documentés, pas des promesses ni des prescriptions.",
]

export function DisclaimerText() {
  return (
    <div className="space-y-3 text-[15px] leading-relaxed">
      {DISCLAIMER_TEXT.map((t) => (
        <p key={t}>{t}</p>
      ))}
    </div>
  )
}

export function DisclaimerGate({ onAccept }: { onAccept: () => void }) {
  return (
    <div className="min-h-[100dvh] flex flex-col px-5 pt-[max(env(safe-area-inset-top),24px)] pb-[max(env(safe-area-inset-bottom),24px)]">
      <h1 className="display text-3xl mb-6">Avant de commencer</h1>
      <div className="card flex-1">
        <DisclaimerText />
      </div>
      <button className="btn-primary w-full mt-6" onClick={onAccept}>
        J'ai compris
      </button>
    </div>
  )
}
