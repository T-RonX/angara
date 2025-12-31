<?php

declare(strict_types=1);

namespace App\SystemBundle\Controller;

use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpKernel\Attribute\AsController;
use Symfony\Component\Security\Http\Authentication\AuthenticationUtils;

#[AsController]
class AuthenticationController // extends AbstractController
{

    public function __construct()
    {
    }

    public function login(Request $request, AuthenticationUtils $authenticationUtils): Response
    {

    }
}
