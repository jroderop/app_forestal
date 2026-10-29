/* =====================================================================
   Formulario traducido del XLSForm de inventario de campo (Survey123).
   - name = nombre de la pregunta en el XLSForm = nombre del campo en la capa.
   - Los repeats se guardan en tablas relacionadas (parentglobalid), igual que Survey123.
   - Los cálculos están en js/calc.js (mismas fórmulas que la columna "calculation").
   ===================================================================== */
(function (g) {
  const L = (pairs) => pairs.map(([name, label]) => ({ name, label }));

  const LISTS = {
    list_afloramientos: L([["Escasos", "Escasos"], ["Poco Abundantes", "Poco Abundantes"], ["Moderado", "Moderado"], ["Abundantes", "Abundantes"], ["Muy Abundantes", "Muy Abundantes"]]),
    list_pedregosidad: L([["Discontinua", "Discontinua"], ["Puntual", "Puntual"], ["Regular", "Regular"], ["Continuo", "Continuo"]]),
    list_espec_tree: L([
      ["Lentisco", "Pistacia lentiscus"], ["Encina", "Quercus ilex"], ["Quejigo", "Quercus faginea"], ["Acebuche", "Olea europaea"],
      ["Algarrobo", "Ceratonia siliqua"], ["Majuelo", "Crataegus monogyna"], ["Aladierno", "Rhamnus alaternus"], ["Retama", "Retama sphaerocarpa"],
      ["Cornicabra", "Pistacia terebinthus"], ["Pino", "Pinus spp"], ["Olivilla", "Teucrium fruticans"], ["Labiernágo", "Phillyrea angustifolia"],
      ["Coscoja", "Quercus coccifera"], ["Madroño", "Arbutus unedo"], ["Espino_negro", "Rhamnus lycioides"], ["Pino_carrasco", "Pinus halepensis"],
      ["Eucalipto", "Eucalyptus spp."], ["otro", "Otra especie (especificar)"]
    ]),
    list_espec_bush: L([
      ["Jara blanca", "Cistus albidus"], ["Jara negra", "Cistus monspeliensis"], ["Palmito", "Chamaerops humilis"], ["Matagallos", "Phlomis purpurea"],
      ["Torvisco", "Daphne gnidium"], ["Erguén", "Calicotome spinosa"], ["Ulex spp", "Aulaga"], ["Asparagus acutifolius", "Esparraguera silvestre"],
      ["otro", "Otra especie (especificar)"]
    ]),
    // En el XLSForm la opción "12-20" está bajo "list_DNm" (con m minúscula) y Survey123 no la muestra.
    // Aquí se incluye: es una clase diamétrica necesaria para que las clases sean continuas.
    list_DNM: L([["1", "≤ 12"], ["2", "12–20"], ["3", "20–30"], ["4", "> 30"]]),
    list_DBM: L([["1", "≤ 3"], ["2", "> 3"]]),
    list_corta: L([["Corta_Si", "Sí"], ["Corta_No", "No"]]),
    list_poda: L([["Poda_Si", "Sí"], ["Poda_No", "No"]]),
    list_roza: L([["Roza_Si", "Sí"], ["Roza_No", "No"]]),
    list_piesmenores: L([["Pies_Si", "Sí"], ["Pies_No", "No"]])
  };

  const PAGES = [
    {
      id: "DatosGenerales", title: "Datos generales de la parcela",
      hint: "Características generales de las parcelas de inventario",
      fields: [
        { name: "ForestName", label: "Nombre del monte", type: "text" },
        { name: "Cod_Rodal", label: "Código del rodal", type: "text" },
        { name: "Size_Rodal", label: "Tamaño del rodal", hint: "Hectáreas", type: "decimal", unit: "ha" },
        { name: "ID_Parcela", label: "Identificador de la parcela", type: "text" },
        { name: "Slp_Parcela", label: "Pendiente de la parcela", hint: "Porcentaje", type: "decimal", unit: "%" },
        { name: "Loc", label: "Ubicación de la observación", hint: "Si el GPS no alcanza precisión, ubica el punto a mano en el mapa", type: "geopoint", required: true }
      ]
    },
    {
      id: "Caract", title: "Caracterización",
      fields: [
        { name: "Foto_NS1", label: "Foto Norte", hint: "Fotografía en dirección N desde el centro de la parcela", type: "image", required: true },
        { name: "Foto_NS2", label: "Foto Sur", hint: "Fotografía en dirección S desde el centro de la parcela", type: "image", required: true },
        { name: "Afloramiento", label: "Afloramientos", hint: "Abundancia de afloramientos", type: "select_one", list: "list_afloramientos", appearance: "likert" },
        { name: "Pedregosidad", label: "Pedregosidad", hint: "Nivel de continuidad de la pedregosidad", type: "select_one", list: "list_pedregosidad", appearance: "likert" },
        { name: "Radio", label: "Radio de parcela", hint: "Metros", type: "decimal", unit: "m" },
        { name: "Ntrees", label: "Número de árboles (pies)", type: "integer", unit: "pies" },
        { name: "Sup", label: "Superficie de la parcela", type: "calc", unit: "ha", hidden: false, decimals: 4 },
        { name: "Density", label: "Densidad", hint: "Pies/ha · Nº de árboles ÷ superficie", type: "calc", unit: "pies/ha", decimals: 1 },
        { name: "Observaciones", label: "Observaciones", type: "text", appearance: "multiline" }
      ]
    },
    {
      id: "Estratos", title: "Estratos arbóreo y arbustivo",
      repeats: [
        {
          name: "InventarioTrees", title: "Especies arbóreas", itemLabel: "Especie arbórea",
          fields: [
            { name: "EspecTree", label: "Especie", type: "select_one", list: "list_espec_tree", appearance: "minimal" },
            { name: "otra_tree", label: "Escriba el nombre de la especie", type: "text", relevant: (r) => r.EspecTree === "otro" },
            { name: "DiamNomMed", label: "Diámetro nominal medio (cm)", type: "select_one", list: "list_DNM", appearance: "compact" },
            { name: "Altura", label: "Altura (m)", hint: "Altura media de la clase diamétrica", type: "decimal", unit: "m" },
            { name: "NPies", label: "Número de pies", hint: "Pies que pertenecen a la clase diamétrica", type: "integer", unit: "pies" },
            { name: "DensityTree", label: "Densidad arbórea (especie)", hint: "Pies/ha · Nº de pies ÷ superficie", type: "calc", unit: "pies/ha", decimals: 1 },
            { name: "Corta", label: "Propuesta de corta", type: "select_one", list: "list_corta", appearance: "compact" },
            { name: "Poda", label: "Propuesta de poda", type: "select_one", list: "list_poda", appearance: "compact" },
            { name: "Observ_Tree", label: "Observaciones estrato arbóreo", type: "text", appearance: "multiline" }
          ]
        },
        {
          name: "InventarioGrass", title: "Especies arbustivas", itemLabel: "Especie arbustiva",
          fields: [
            { name: "EspecBush", label: "Especie", type: "select_one", list: "list_espec_bush", appearance: "minimal" },
            { name: "otra_bush", label: "Escriba el nombre de la especie", type: "text", relevant: (r) => r.EspecBush === "otro" },
            // select_multiple en el XLSForm (se guarda "1,2"). Las clases son excluyentes: ver README.
            { name: "DiamBasalMed", label: "Diámetro basal medio (cm)", type: "select_multiple", list: "list_DBM", appearance: "compact" },
            { name: "FCC", label: "Fracción de cabida cubierta", type: "integer", unit: "%" },
            { name: "HM", label: "Altura media (m)", type: "decimal", unit: "m" },
            { name: "Roza", label: "Propuesta de roza", type: "select_one", list: "list_roza", appearance: "compact" },
            { name: "Pies_Menores", label: "Presencia de pies menores", hint: "Dn < 7,5 cm y H > 1,3 m", type: "select_one", list: "list_piesmenores", appearance: "compact" },
            { name: "Observ_Bush", label: "Observaciones estrato arbustivo", type: "text", appearance: "multiline" }
          ]
        }
      ]
    }
  ];

  // Campo que da título a cada registro en las listas
  const TITLE = (r) => [r.ForestName, r.Cod_Rodal && ("Rodal " + r.Cod_Rodal), r.ID_Parcela && ("Parcela " + r.ID_Parcela)].filter(Boolean).join(" · ") || "Parcela sin identificar";

  g.FORM = { LISTS, PAGES, TITLE };
})(self);
