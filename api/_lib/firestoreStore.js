/**
 * Banco de dados do envio de notificações: Firestore (Admin SDK) em `igrejas/<igreja>/...`.
 * Implementa o contrato usado por `pushCore.js` (`pending`, `claim`, `devices`, `users`, `roles`, `removeDevice`).
 */
export function firestoreStore(db, tenant) {
  const col = (name) => db.collection('igrejas').doc(tenant).collection(name)

  return {
    /** Notificações ainda não enviadas (o app as cria com `pushedAt: null`; as antigas não têm o campo e ficam de fora). */
    async pending(limit) {
      const snapshot = await col('notifications').where('pushedAt', '==', null).limit(limit).get()
      return snapshot.docs.map((doc) => ({ id: doc.id, data: doc.data() }))
    },

    /** Marca como enviada, uma única vez: devolve `false` se outra chamada chegou primeiro. */
    claim(id, extra = {}) {
      return db.runTransaction(async (tx) => {
        const ref = col('notifications').doc(id)
        const snapshot = await tx.get(ref)
        if (!snapshot.exists || snapshot.get('pushedAt') !== null) return false
        tx.update(ref, { pushedAt: new Date().toISOString(), ...extra })
        return true
      })
    },

    async devices() {
      const snapshot = await col('devices').get()
      return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
    },

    async users(ids) {
      const docs = await Promise.all(ids.map((id) => col('users').doc(id).get()))
      return new Map(docs.filter((doc) => doc.exists).map((doc) => [doc.id, { id: doc.id, ...doc.data() }]))
    },

    async roles() {
      const snapshot = await col('roles').get()
      return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
    },

    async removeDevice(id) {
      await col('devices').doc(id).delete()
    },

    /** Chaves do Web Push (VAPID): geradas na primeira vez e guardadas num documento que nenhum aplicativo consegue ler. */
    async vapid(generate) {
      const ref = col('pushConfig').doc('vapid')
      const existing = await ref.get()
      if (existing.exists) return existing.data()
      const keys = generate()
      try {
        await ref.create({ ...keys, createdAt: new Date().toISOString() })
        return keys
      } catch {
        // outra chamada criou ao mesmo tempo: vale a que já está gravada
        return (await ref.get()).data()
      }
    },
  }
}
