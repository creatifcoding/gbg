/**
 * CRD Registration
 * Pattern: pepr-excellent-examples/pepr-operator
 *
 * Alchemy applies these CRDs as Kubernetes.Manifest. Call RegisterCRDs() only
 * when a cluster is reachable. Unit tests must not execute Apply.
 */

import { K8s, Log, kind } from 'pepr'
import { LabAppletCRD } from './source/lab-applet.crd'
import { LabImageCRD } from './source/lab-image.crd'
import { LabRegistryCRD } from './source/lab-registry.crd'
import { LabWorkloadCRD } from './source/lab-workload.crd'

export const RegisterCRDs = () => {
  Promise.all([
    K8s(kind.CustomResourceDefinition)
      .Apply(LabImageCRD, { force: true })
      .then(() => Log.info('LabImage CRD registered')),
    K8s(kind.CustomResourceDefinition)
      .Apply(LabRegistryCRD, { force: true })
      .then(() => Log.info('LabRegistry CRD registered')),
    K8s(kind.CustomResourceDefinition)
      .Apply(LabWorkloadCRD, { force: true })
      .then(() => Log.info('LabWorkload CRD registered')),
    K8s(kind.CustomResourceDefinition)
      .Apply(LabAppletCRD, { force: true })
      .then(() => Log.info('LabApplet CRD registered')),
  ]).catch(err => {
    Log.error(err)
    process.exit(1)
  })
}
