import { Request, Response } from 'express';
import { getLocals, getLocalById, updateLocal, deleteLocal } from '../services/local.service';

export const handleGetLocals = async (_req: Request, res: Response) => {
  try {
    const locals = await getLocals();
    res.status(200).json(locals);
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener los locales.' });
  }
};

export const handleGetLocalById = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const local = await getLocalById(String(id));
    if (local) {
      res.status(200).json(local);
    } else {
      res.status(404).json({ message: 'Local no encontrado.' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener el local.' });
  }
};

export const handleUpdateLocal = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { 
    name, description, address, phone, email, 
    type_local, image_url, latitude, longitude, active 
  } = req.body;

  // Solo enviamos los campos que pertenecen al modelo Local
  const localData: any = {};
  if (name !== undefined) localData.name = name;
  if (description !== undefined) localData.description = description;
  if (address !== undefined) localData.address = address;
  if (phone !== undefined) localData.phone = phone;
  if (email !== undefined) localData.email = email;
  if (type_local !== undefined) localData.type_local = type_local;
  if (image_url !== undefined) localData.image_url = image_url;
  if (latitude !== undefined) localData.latitude = Number(latitude);
  if (longitude !== undefined) localData.longitude = Number(longitude);
  if (active !== undefined) localData.active = Boolean(active);

  try {
    const updatedLocal = await updateLocal(String(id), localData);
    res.status(200).json(updatedLocal);
  } catch (error: any) {
    res.status(404).json({ message: error.message || 'Local no encontrado para actualizar.' });
  }
};

export const handleDeleteLocal = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    await deleteLocal(String(id));
    res.status(200).json({ message: 'Local eliminado exitosamente.' });
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Error al eliminar el local.' });
  }
};